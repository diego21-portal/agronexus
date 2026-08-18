export type UserRole =
  | "CUSTOMER"
  | "SELLER"
  | "LOGISTICS_OPERATOR"
  | "ADMIN"
  | "SUPERADMIN";

export interface UserProfile {
  id?: number;

  phone?: string;
  document_type?: string;
  document_number?: string;

  birth_date?: string | null;

  preferred_theme?: string;

  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: number;

  email: string;
  username: string;

  first_name: string;
  last_name: string;

  role: UserRole;

  profile?: UserProfile;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface RegisterRequest {
  email: string;
  username: string;

  first_name: string;
  last_name: string;

  password: string;
  password_confirm: string;
}