import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { fetchChatDashboard } from '../../services/messageCenterService';
import { getLoggedInUser } from '../../services/authService';
import { mapRecentChatUser, attachmentPreviewLabel } from './messageCenterHelpers';
import { SkeletonList } from '../../components/common/ContentLoader';
import { useNotify } from '../../context/NotificationContext';
import { LegacyIcon } from '../../components/common/CustomIcons';

const attachmentIcon = (type) => {
    switch (type) {
        case 'DOCU': return 'mdi-file-document-outline';
        case 'VIDEO': return 'mdi-video-outline';
        case 'AUDIO': return 'mdi-microphone-outline';
        case 'IMG': return 'mdi-image-outline';
        default: return '';
    }
};

/**
 * Recent-chat users list (legacy EhrTextMessageCenterUserList). Now backed by
 * TanStack useInfiniteQuery: cached + de-duplicated dashboard fetches, debounced
 * name search (drives the query key), infinite-scroll pagination (length 7),
 * unread badges, and last-message preview. `refreshKey` bumps re-fetch the list
 * after a message is sent / marked read (legacy UpdateUserDetails event).
 */
const MessageCenterUserList = ({ selectedUserId, onSelect, onNewChat, refreshKey }) => {
    const { notifyError } = useNotify();
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // debounce the typed term (500ms) — the debounced value is the query key
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 500);
        return () => clearTimeout(timer);
    }, [search]);

    const {
        data, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch,
    } = useInfiniteQuery({
        queryKey: ['chatDashboard', debouncedSearch],
        initialPageParam: 0,
        queryFn: ({ pageParam }) => fetchChatDashboard({ start: pageParam, search: debouncedSearch }),
        getNextPageParam: (lastPage, allPages) => {
            const loaded = allPages.reduce((sum, page) => sum + (page?.data?.data?.length || 0), 0);
            const total = lastPage?.data?.totalCount || 0;
            return total > loaded ? loaded : undefined;
        },
        placeholderData: keepPreviousData,
    });

    // External refresh after a message is sent / marked read.
    useEffect(() => { if (refreshKey) refetch(); }, [refreshKey, refetch]);

    useEffect(() => {
        if (isError) {
            console.error('Failed to fetch chat dashboard.', error);
            notifyError(error?.message || 'Failed to fetch the list of users with whome logged in user has communicated with. Please try again.');
        }
    }, [isError, error, notifyError]);

    const users = useMemo(
        () => (data ? data.pages.flatMap((page) => (page?.data?.data || []).map(mapRecentChatUser)) : null),
        [data],
    );

    const listRef = useRef(null);
    const rowVirtualizer = useVirtualizer({
        count: users?.length || 0,
        getScrollElement: () => listRef.current,
        estimateSize: () => 72,
        overscan: 6,
    });

    const loggedInUser = getLoggedInUser();
    // TODO: the logged-in user's full name is server-injected in legacy (JSP
    // `${userFullName}`) and isn't in the JWT; fall back to the `sub` claim.
    const loggedInName = loggedInUser?.userFullName || loggedInUser?.fullName || loggedInUser?.name || loggedInUser?.sub || '';
    const loggedInInitial = (() => {
        const parts = String(loggedInName).trim().split(' ').filter(Boolean);
        if (!parts.length) return '';
        return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
    })();

    const onScroll = (event) => {
        const { scrollHeight, scrollTop, clientHeight } = event.target;
        if (Math.abs(scrollHeight - clientHeight - scrollTop) <= 1 && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    };

    return (<div className="mc-chat-user-list-col col-md-3 p-0">
      <div className="p-2 d-flex justify-content-between align-items-center" style={{ borderBottom: '1px solid #e1e5ea' }}>
        <div className="d-flex align-items-center fw-bold">
          <div className="mc-logged-in-user-initial text-uppercase">{loggedInInitial}</div>
          <div className="text-capitalize" style={{ fontSize: '1rem' }}>{loggedInName}</div>
        </div>
        <span role="button" title="New Chat" onClick={onNewChat}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 18 18" fill="var(--app-color2, #189FAA)">
            <path d="M9 1.6875A7.3125 7.3125 0 1 0 9 16.3125 7.3125 7.3125 0 0 0 9 1.6875ZM9 18A9 9 0 1 1 9 0a9 9 0 0 1 0 18ZM8.15625 12.0938a.84375.84375 0 0 0 1.6875 0V9.84375h2.25a.84375.84375 0 0 0 0-1.6875h-2.25V5.90625a.84375.84375 0 0 0-1.6875 0v2.25H5.90625a.84375.84375 0 0 0 0 1.6875h2.25v2.25Z"/>
          </svg>
        </span>
      </div>

      <div className="d-flex my-2 px-2 align-items-center justify-content-between">
        <span className="fw-semibold" style={{ color: '#526172', fontSize: '0.88rem' }}>Messages</span>
      </div>

      <div className="px-2 my-2 icon-input-group position-relative">
        <input type="text" className="form-control text-capitalize mc-chat-user-search" placeholder="Search messages"
          value={search} onChange={(e) => setSearch(e.target.value)}/>
        <LegacyIcon icon="mdi-magnify" className="input-icon" style={{ position: 'absolute', right: 14, top: 6 }}/>
      </div>

      <div className="mc-recent-users-section custom-scrollbar" ref={listRef} onScroll={onScroll}>
        {users === null && <div className="p-2"><SkeletonList rows={6}/></div>}
        {users !== null && users.length === 0 && (
          <div className="nodata mc-no-conversation">No Conversation Yet!</div>
        )}
        {users !== null && users.length > 0 && (
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const user = users[vRow.index];
              return (
                <div key={`${user.userId}_${vRow.index}`} ref={rowVirtualizer.measureElement} data-index={vRow.index}
                  className={`mc-chat-user-lists ${String(user.userId) === String(selectedUserId) ? 'active' : ''}`}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}>
                  <div className="mc-chat-users" role="button" onClick={() => onSelect(user)}>
                    <span className="mc-chat-user-icon text-uppercase">{user.initials}</span>
                    <div className="mc-chat-user-details">
                      <p className="mb-0 mc-chat-user-fullname text-capitalize" style={{ color: user.isMessageSentFlag === 'N' ? '#ff7801' : '#526172' }}>
                        <b>{user.name}{user.isMessageSentFlag === 'N' ? ' (Deactivated)' : ''}</b>
                      </p>
                      <p className="mb-0 mc-chat-user-last-message">
                        {user.attachmentType
                          ? (<><LegacyIcon icon={attachmentIcon(user.attachmentType)}/> {attachmentPreviewLabel(user.attachmentType, user.isMessageSent)}</>)
                          : (user.decryptedMessage || '').replace(/\n/g, ' ')}
                      </p>
                    </div>
                    <div className="mc-chat-user-meta">
                      <span className={`mc-chat-user-last-message-time ${user.unReadMessage > 0 ? 'unread' : ''}`}>{user.lastMessageTime}</span>
                      {user.unReadMessage > 0 && <span className="mc-chat-user-unread-count">{user.unReadMessage}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {isFetchingNextPage && <div className="p-2"><SkeletonList rows={2}/></div>}
      </div>
    </div>);
};
export default MessageCenterUserList;
