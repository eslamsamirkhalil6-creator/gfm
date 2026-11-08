export interface LoginResponse {
  token: string;
  expiresIn: string;
  user: {
    id: number;
    username: string;
    full_name: string;
    is_active: boolean;
    roles: string[];
    permissions: string[];
  };
}

export interface UserProfile {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
  permissions: string[];
  created_at: string;
}
