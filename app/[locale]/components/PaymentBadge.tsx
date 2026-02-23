import { PaymentStatus } from '@/lib/types';

interface PaymentBadgeProps {
  status: PaymentStatus;
  className?: string;
}

export function PaymentBadge({ status, className = '' }: PaymentBadgeProps) {
  const isPaid = status === PaymentStatus.PAID;
  
  return (
    <span
      className={`text-xs px-2 py-1 rounded-full font-medium ${
        isPaid
          ? 'bg-green-100 text-green-700'
          : 'bg-yellow-100 text-yellow-700'
      } ${className}`}
    >
      {isPaid ? '✓ PAID' : 'UNPAID'}
    </span>
  );
}
