import { useState, useEffect, useRef } from "react";
//import { Check } from "lucide-react";
import { authApi } from "../../services/api";
import { Trash } from "lucide-react";

type Notification = {
  id: number;
  user_id: number;
  bot_id: number;
  event_type: string;
  event_data: string;
  is_read: boolean;
  created_at: Date;
};

export const NotificationDropdown = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      try {
        const data = await authApi.fetchNotifications();
        if (isMounted) {
          setNotifications(data);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching notifications", error);
      }
    };

    loadNotifications(); // Initial load

    const intervalId = setInterval(loadNotifications, 10000); // Poll every 30 sec

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleMarkAsRead = async (id: number) => {
    try {
      await authApi.markNotificationAsRead(id); // 👈 create this in your api service
      setNotifications((prev) => prev.filter((notif) => notif.id !== id));
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await authApi.markAllNotificationsAsRead(); // 👈 create this too
      setNotifications([]);
    } catch (error) {
      console.error("Failed to mark all notifications as read", error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white relative"
        onClick={() => setOpen((prev) => !prev)}
      >
        Notifications
        {notifications.length > 0 && (
          <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
            {notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="flex justify-between items-center px-4 py-2 border-b dark:border-gray-600 text-sm text-gray-800 dark:text-white font-semibold">
            <span>Notifications</span>
            {notifications.length > 0 && (
              <button onClick={handleMarkAllAsRead} title="Mark all as read">
                <Trash className="w-4 h-4 text-red-500 hover:text-red-700" />
              </button>
            )}
          </div>

          <ul className="max-h-80 overflow-y-auto">
            {loading ? (
              <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                Loading...
              </li>
            ) : notifications.length > 0 ? (
              notifications.map((notif) => (
                <li
                  key={notif.id}
                  className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 flex justify-between items-start hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div>
                    <p>{notif.event_data}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(notif.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleMarkAsRead(notif.id)}
                    title="Mark as read"
                    className="ml-2"
                  >
                    <Trash className="w-3 h-3 text-red-500 hover:text-red-700" />
                  </button>
                </li>
              ))
            ) : (
              <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                No new notifications.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
