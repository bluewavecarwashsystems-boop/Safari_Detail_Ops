import { PaymentStatus } from '@/lib/types';

interface PaymentBadgeProps {
  status: PaymentStatus;
  className?: string;
}

export function PaymentBadge({ status, className = '' }: PaymentBadgeProps) {
  const isPaid = status === PaymentStatus.PAID;
  
  return (
    <span
      className={`text-xs px-3 py-1 rounded-full font-medium border transition-all duration-150 ${
        isPaid
          ? 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]'
          : 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]'
      } ${className}`}
    >
      {isPaid ? '✓ PAID' : 'UNPAID'}
    </span>
  );
}
