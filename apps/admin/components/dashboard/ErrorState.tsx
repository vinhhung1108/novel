export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-red-600">
      {message}
    </div>
  );
}
