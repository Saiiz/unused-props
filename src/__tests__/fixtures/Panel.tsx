interface PanelProps {
  title: string;
  footer: string;
}

export function Panel({ title, ...rest }: PanelProps): JSX.Element {
  return <div title={title} {...rest} />;
}
