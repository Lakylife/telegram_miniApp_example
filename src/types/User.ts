import { Task } from './Task';
import { Referral } from './Referral';

export interface User {
  invitedUsers: any;
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name: string;
  username: string;
  language_code: string;
  is_premium: boolean;
  added_to_attachment_menu: boolean;
  allows_write_to_pm: boolean;
  photo_url: string;
  tokens: number;
  tickets: number;
  referral_code: string;
  invited_users_count: number;
  referrals_count: number;
  tasks: Task[]; // Ensure Task is imported correctly
  referrals: Referral[]; // Ensure Referral is imported correctly
  referralEarnings?: number; // Přidáno
  incompleteTasks?: number; // Přidáno
  is_active: boolean;
}
