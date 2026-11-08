export interface UserDto {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  roles: {
    id: number;
    role_name: string;
  }[];
}

export interface RoleDto {
  id: number;
  role_name: string;
  description: string;
  permissions: {
    id: number;
    permission_key: string;
    description: string;
  }[];
}

export interface CreateUserInput {
  username: string;
  password: string;
  full_name: string;
  roleIds?: number[];
}

export interface UpdateUserStatusInput {
  is_active: boolean;
}

export interface UpdateUserRolesInput {
  roleIds: number[];
}
