// types/Referral.ts
export interface Referral {
  id: number;
  first_name: string;
  username: string;
  tokens: number;
  referred_users_count: number;
  invited_by: string | null;
  tokens_earned: number;
  photo_url: string;
}
