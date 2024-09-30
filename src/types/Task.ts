export interface Task {
  id: number;
  icon: string;
  title: string;
  token_reward: number;
  status: string;
  link?: string;
  priority: number;
  required_friends?: number | null;
  required_tasks?: number | null;
  required_tokens?: number | null;
}
