import api from './api';

export interface GitHubConfig {
  id: string;
  name: string;
  owner: string;
  repo: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listGitHubConfigs(): Promise<GitHubConfig[]> {
  const { data } = await api.get('/integrations/github-configs');
  return data.data;
}

export async function createGitHubConfig(payload: { name: string; owner: string; repo: string; token: string; active?: boolean }): Promise<GitHubConfig> {
  const { data } = await api.post('/integrations/github-configs', payload);
  return data.data;
}

export async function updateGitHubConfig(id: string, payload: Partial<{ name: string; owner: string; repo: string; token: string; active: boolean }>): Promise<GitHubConfig> {
  const { data } = await api.patch(`/integrations/github-configs/${id}`, payload);
  return data.data;
}

export async function deleteGitHubConfig(id: string): Promise<void> {
  await api.delete(`/integrations/github-configs/${id}`);
}
