import { useQuery } from "@tanstack/react-query";
import { listTrees } from "@/api/trees";
import { Spinner } from "@/components/Spinner";

export function TreePanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["trees"],
    queryFn: listTrees,
  });

  if (isLoading) return <Spinner />;
  if (error) return <p className="text-red-400 text-sm">Failed to load trees.</p>;

  return (
    <div className="space-y-2 text-sm">
      <p className="text-slate-500">React Flow visualization — coming soon.</p>
      <ul className="space-y-1">
        {data?.trees?.map((tree) => (
          <li key={tree.id} className="rounded border border-slate-800 px-2 py-1">
            <span className="font-medium text-slate-200">{tree.name}</span>
            <span className="ml-2 text-slate-500">{tree.id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
