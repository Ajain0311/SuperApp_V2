import { AppEnvironment } from '../config/environment';
import { apiClient } from './apiClient';

export interface StoredDocument {
  documentNo: string;
  documentName: string;
  imageUrl: string;
  byteSize: number;
}

function absoluteImageUrl(path: string): string {
  if (!path) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const origin = AppEnvironment.baseUrl.replace(/\/api\/?$/, '');
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

import * as ImageManipulator from 'expo-image-manipulator';

class DocumentService {
  async upload(uri: string, fileName = 'photo.jpg', assign?: 'profile'): Promise<StoredDocument> {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

    const form = new FormData();
    form.append('file', {
      uri: manipResult.uri,
      name: fileName,
      type: 'image/jpeg',
    } as any);
    const query = assign === 'profile' ? '?assign=profile' : '';
    const res = await apiClient.post<any>(`/documents${query}`, form);
    const data = res.data?.data || res.data;
    return {
      documentNo: data.documentNo,
      documentName: data.documentName,
      imageUrl: absoluteImageUrl(data.imageUrl),
      byteSize: data.byteSize,
    };
  }

  async remove(documentNo: string): Promise<void> {
    await apiClient.delete(`/documents/${documentNo}`);
  }
}

export const documentService = new DocumentService();
export { absoluteImageUrl };
