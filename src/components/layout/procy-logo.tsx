type ProcyLogoProps = {
  className?: string;
};

/** The shared PROCY mark used anywhere the application identifies itself. */
export function ProcyLogo({ className = "" }: ProcyLogoProps) {
  return <img src="/procy-logo.png" alt="PROCY logo" className={`object-contain ${className}`} />;
}
