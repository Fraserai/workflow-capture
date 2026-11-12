import { redirect } from "next/navigation";

type SessionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;
  redirect(`/app/captures?selected=${encodeURIComponent(id)}`);
}
