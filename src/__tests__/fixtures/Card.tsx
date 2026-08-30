interface CardProps {
  title: string;
  subtitle: string; // never read below - should be flagged
}

export function Card(props: CardProps): JSX.Element {
  return <div>{props.title}</div>;
}
