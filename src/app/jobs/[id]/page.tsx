import { JobDetailShell } from '@/components/job-detail-shell'

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <JobDetailShell jobId={id} />
}
