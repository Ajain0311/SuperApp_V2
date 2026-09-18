export interface User {
  id: number;
  mobileNumber: string;
  fullName?: string | null;
  email?: string | null;
  profileImageUrl?: string | null;
  roles: string[];
}

export interface SendOtpRequest {
  mobileNumber: string;
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
  isNewUser: boolean;
  isAdmin: boolean;
  devOtp?: string;
}

export interface VerifyOtpRequest {
  mobileNumber: string;
  otpCode: string;
  fullName?: string;
}

export interface AdminLoginRequest {
  mobileNumber: string;
  password: string;
  otpCode?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
}

export interface UpdateProfileRequest {
  fullName?: string;
  email?: string;
  profileImageUrl?: string;
}
