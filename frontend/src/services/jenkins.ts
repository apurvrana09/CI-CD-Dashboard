import api from './api';

export async function getJenkinsBuildLog(jobName: string, buildNumber: number, providerId: string): Promise<string> {
  const res = await api.get(`/integrations/jenkins/jobs/${encodeURIComponent(jobName)}/builds/${encodeURIComponent(String(buildNumber))}/log`, {
    params: { providerId },
    responseType: 'text',
    transformResponse: [(data: unknown) => data as any],
  });
  // Axios may wrap plain text differently; ensure string
  const text = (res as any).data;
  if (typeof text === 'string') return text;
  // If backend returns JSON with data
  return (text && text.data) || '';
}
