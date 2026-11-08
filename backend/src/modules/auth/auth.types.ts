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
    managed_department_ids: number[];
    primary_department_id: number | null;
  };
}

export interface UserProfile {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
  permissions: string[];
  managed_department_ids: number[];
  primary_department_id: number | null;
  created_at: string;
}

