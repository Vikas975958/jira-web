"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Loader from "@/components/Loader";

export default function TaskRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params?.id) {
      router.replace(`/issues/${params.id}`);
    } else {
      router.replace("/tasks");
    }
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader />
    </div>
  );
}
