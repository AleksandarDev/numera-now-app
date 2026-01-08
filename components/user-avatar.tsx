import { cn } from '@/lib/utils';

interface UserAvatarProps {
    userId: string;
    className?: string;
}

/**
 * Simple user avatar component that displays user initials
 * based on Clerk user ID
 */
export function UserAvatar({ userId, className }: UserAvatarProps) {
    // Extract initials from user ID (Clerk IDs start with "user_")
    // For Clerk IDs like "user_2abc123def", we'll use the first 2 characters after the underscore
    const getInitials = (id: string) => {
        if (!id) return '??';

        // Remove "user_" prefix if present
        const cleanId = id.startsWith('user_') ? id.substring(5) : id;

        // Take first 2 characters and uppercase them
        return cleanId.substring(0, 2).toUpperCase();
    };

    // Generate a consistent color based on the user ID
    const getColorFromId = (id: string) => {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = id.charCodeAt(i) + ((hash << 5) - hash);
        }

        // Use a set of pleasant, accessible colors
        const colors = [
            'bg-blue-500',
            'bg-green-500',
            'bg-purple-500',
            'bg-pink-500',
            'bg-indigo-500',
            'bg-teal-500',
            'bg-orange-500',
            'bg-cyan-500',
        ];

        return colors[Math.abs(hash) % colors.length];
    };

    const initials = getInitials(userId);
    const colorClass = getColorFromId(userId);

    return (
        <div
            className={cn(
                'inline-flex items-center justify-center rounded-full text-white font-medium',
                'w-6 h-6 text-xs',
                colorClass,
                className,
            )}
            title={userId}
        >
            {initials}
        </div>
    );
}
