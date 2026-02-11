import { useEffect, useState } from 'react';

export function Avatar(props: { url?: string | null; label: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = (props.url ?? '').trim();

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div className={props.className}>
      {src && !failed ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        (props.label ?? '•').trim()[0] ?? '•'
      )}
    </div>
  );
}

