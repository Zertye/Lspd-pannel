import { BADGE_VARIANTS } from '../../utils/constants';

export function Badge({ variant = "default", children, className = "" }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${BADGE_VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  );
}

export default Badge;
