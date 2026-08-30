interface AvatarProps {
  url: string;
  size: number; // destructured but never referenced again - should be flagged
}

export function Avatar({ url, size }: AvatarProps): JSX.Element {
  return <img src={url} />;
}
