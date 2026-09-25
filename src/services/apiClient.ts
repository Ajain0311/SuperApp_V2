import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { AppEnvironment } from '../config/environment';
import { storage } from './storage';

export interface AppError {
  message: string;
  statusCode?: number;
  isNetworkError?: boolean;
  isTimeout?: boolean;
  isUnauthorized?: boolean;
  errors?: string[];
}

export class ApiError extends Error implements AppError {
  statusCode?: number;
  isNetworkError?: boolean;
  isTimeout?: boolean;
  isUnauthorized?: boolean;
  errors?: string[];

  constructor(message: string, options?: Partial<AppError>) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = options?.statusCode;
    this.isNetworkError = options?.isNetworkError;
    this.isTimeout = options?.isTimeout;
    this.isUnauthorized = options?.isUnauthorized;
    this.errors = options?.errors;
  }
}

class ApiClient {
  private client: AxiosInstance;
  private onUnauthorizedCallback: (() => void) | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: AppEnvironment.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    this.setupInterceptors();
  }

  public registerUnauthorizedHandler(callback: () => void) {
    this.onUnauthorizedCallback = callback;
  }

  private setupInterceptors() {
    // Request interceptor: attach bearer token and log
    this.client.interceptors.request.use(
      async (config) => {
        // Dynamically ensure baseURL matches environment in case of runtime change
        config.baseURL = AppEnvironment.baseUrl;

        const token = await storage.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        if (AppEnvironment.enableLogging) {
          console.log(`[API Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, config.data || '');
        }

        return config;
      },
      (error) => Promise.reject(this.normalizeError(error))
    );

    // Response interceptor: handle 401, server down, and timeouts
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        if (AppEnvironment.enableLogging) {
          console.log(`[API Response] ${response.status} ${response.config.url}`, response.data);
        }
        return response;
      },
      (error: AxiosError) => {
        const normalized = this.normalizeError(error);

        if (normalized.isUnauthorized) {
          if (this.onUnauthorizedCallback) {
            this.onUnauthorizedCallback();
          }
        }

        if (AppEnvironment.enableLogging) {
          console.warn(`[API Error] ${normalized.statusCode || 'NETWORK'} - ${normalized.message}`);
        }

        return Promise.reject(normalized);
      }
    );
  }

  private normalizeError(error: any): ApiError {
    if (axios.isAxiosError(error)) {
      const axiosErr = error as AxiosError<any>;

      // Network errors / server unavailable
      if (axiosErr.code === 'ECONNABORTED' || axiosErr.message.includes('timeout')) {
        return new ApiError('Request timed out. Please check your connection and try again.', {
          isTimeout: true,
          statusCode: 408,
        });
      }

      if (!axiosErr.response) {
        return new ApiError(
          'Unable to connect to the backend server. Please verify the API server is running.',
          { isNetworkError: true }
        );
      }

      const status = axiosErr.response.status;
      const data = axiosErr.response.data;

      // Extract error message from ASP.NET Core ApiResponse or standard payload
      let message = 'An unexpected server error occurred.';
      let errors: string[] = [];

      if (typeof data === 'string') {
        message = data;
      } else if (data) {
        message = data.message || data.title || (data.errors ? Object.values(data.errors).flat().join(', ') : message);
        if (Array.isArray(data.errors)) {
          errors = data.errors;
        }
      }

      if (status === 401) {
        return new ApiError(message || 'Authentication expired or invalid. Please log in again.', {
          statusCode: 401,
          isUnauthorized: true,
        });
      }

      if (status === 403) {
        return new ApiError('You do not have permission to perform this action.', { statusCode: 403 });
      }

      if (status === 404) {
        return new ApiError(message || 'The requested resource was not found.', { statusCode: 404 });
      }

      if (status >= 500) {
        return new ApiError('Server encountered an error. Please try again shortly.', {
          statusCode: status,
        });
      }

      return new ApiError(message, {
        statusCode: status,
        errors,
      });
    }

    if (error instanceof ApiError) {
      return error;
    }

    return new ApiError(error?.message || 'An unexpected application error occurred.');
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
