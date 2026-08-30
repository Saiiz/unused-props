interface ButtonProps {
  label: string;
  onClick: () => void;
  variant: string; // never destructured at all - should be flagged
}

export const Button = ({ label, onClick: handleClick }: ButtonProps): JSX.Element => {
  return <button onClick={handleClick}>{label}</button>;
};
