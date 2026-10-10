using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace SuperApp.API.Services;

public static class ImageByteProcessor
{
    public const int MaxUploadBytes = 8 * 1024 * 1024;
    public const int MaxInputEdge = 8000;
    public const int MaxOutputEdge = 1280;
    public const int JpegQuality = 70;

    public static (byte[] Main, byte[] Thumbnail) CompressAndThumb(byte[] original)
    {
        if (original == null || original.Length == 0)
            throw new InvalidImageException("Empty file");
        if (original.Length > MaxUploadBytes)
            throw new InvalidImageException("Image is larger than 8 MB");

        try
        {
            using var image = Image.Load(original);
            image.Mutate(x => x.AutoOrient());
            
            // Strip metadata to reduce size
            image.Metadata.ExifProfile = null;
            image.Metadata.XmpProfile = null;
            image.Metadata.IptcProfile = null;

            if (image.Width > MaxInputEdge || image.Height > MaxInputEdge)
                throw new InvalidImageException("Image dimensions are too large");
            if (image.Width < 1 || image.Height < 1)
                throw new InvalidImageException("Image has no pixels");

            using var mainImage = image.Clone(x => {
                if (image.Width > MaxOutputEdge || image.Height > MaxOutputEdge)
                {
                    x.Resize(new ResizeOptions
                    {
                        Mode = ResizeMode.Max,
                        Size = new Size(MaxOutputEdge, MaxOutputEdge)
                    });
                }
            });

            using var thumbImage = image.Clone(x => x.Resize(new ResizeOptions
            {
                Mode = ResizeMode.Crop,
                Size = new Size(300, 300)
            }));

            using var mainOutput = new MemoryStream();
            mainImage.SaveAsJpeg(mainOutput, new JpegEncoder { Quality = JpegQuality });
            
            using var thumbOutput = new MemoryStream();
            thumbImage.SaveAsJpeg(thumbOutput, new JpegEncoder { Quality = 60 });

            return (mainOutput.ToArray(), thumbOutput.ToArray());
        }
        catch (InvalidImageException)
        {
            throw;
        }
        catch (UnknownImageFormatException)
        {
            throw new InvalidImageException("Unsupported or corrupt image");
        }
        catch (Exception)
        {
            throw new InvalidImageException("Unsupported or corrupt image");
        }
    }
}

public class InvalidImageException : Exception
{
    public InvalidImageException(string message) : base(message) { }
}
