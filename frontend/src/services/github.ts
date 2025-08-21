import api from './api';

export async function getGithubRunLogs(runId: string | number, providerId?: string): Promise<string> {
  const { data } = await api.get(`/integrations/github/runs/${encodeURIComponent(String(runId))}/logs`, {
    params: providerId ? { providerId } : undefined,
    responseType: 'text',
    transformResponse: [(d: unknown) => d as string],
  });
  // When responseType is 'text', axios puts raw string in data
  return typeof data === 'string' ? data : (data?.toString?.() ?? '');
}
