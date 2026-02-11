import { useEffect, useState } from 'react';
import Image from 'next/image';

export function Avatar(props: { url?: string | null; label: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = (props.url ?? '').trim();

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div className={`${props.className ?? ''} relative`}>
      {src && !failed ? (
        <Image
          loader={({ src }) => src}
          src={src}
          alt=""
          fill
          unoptimized
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        (props.label ?? '•').trim()[0] ?? '•'
      )}
    </div>
  );
}
