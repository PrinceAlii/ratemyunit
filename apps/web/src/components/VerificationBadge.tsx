import { BadgeCheck } from 'lucide-react';

interface VerificationBadgeProps {
  domainVerified: boolean;
  className?: string;
}

export function VerificationBadge({ domainVerified, className = '' }: VerificationBadgeProps) {
  const tooltipText = domainVerified
    ? "Verified university email"
    : "Verified .edu.au email";

  const badgeColor = domainVerified
    ? "text-blue-600"
    : "text-green-600";

  return (
    <BadgeCheck
      className={`h-4 w-4 inline-block ${badgeColor} ${className}`}
      aria-label={tooltipText}
      title={tooltipText}
    />
  );
}
