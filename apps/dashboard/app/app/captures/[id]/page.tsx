import { redirect } from "next/navigation";

type CapturePageProps = {
  params: Promise<{ id: string }>;
};

export default async function CapturePage({ params }: CapturePageProps) {
  const { id } = await params;
  redirect(`/app/captures?selected=${encodeURIComponent(id)}`);
}
