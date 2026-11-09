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
    managed_warehouse_ids: number[];
    supervised_line_ids: number[];
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
  managed_warehouse_ids: number[];
  supervised_line_ids: number[];
  created_at: string;
}


