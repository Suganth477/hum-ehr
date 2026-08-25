import { useCallback, useState } from 'react';
import MessageCenterUserList from './MessageCenterUserList';
import MessageCenterChatView from './MessageCenterChatView';
import MessageCenterNewChatDialog from './MessageCenterNewChatDialog';
import { LegacyIcon } from '../../components/common/CustomIcons';

/**
 * The dropdown body of the header CTC chat (code-split out of CtcHeaderChat so the
 * chat stack loads only when the dropdown is opened). Single-pane: recent-users list,
 * or the selected user's conversation with a back control. Reuses the migrated
 * Message Center components + service layer verbatim; sending/reading bumps refreshKey
 * so the list re-fetches (last message + unread), like the legacy update event.
 */
const CtcHeaderChatPanel = () => {
    const [selectedUser, setSelectedUser] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [newChatOpen, setNewChatOpen] = useState(false);

    const refreshList = useCallback(() => setRefreshKey((key) => key + 1), []);

    return (<div className="ctc-header-chat-panel" role="dialog" aria-label="Care team chat">
      {selectedUser
        ? (<div className="ctc-ind-wrapper">
            <button type="button" className="ctc-ind-back-btn" onClick={() => setSelectedUser(null)}>
              <LegacyIcon icon="mdi-arrow-left" /> <span>Back</span>
            </button>
            <MessageCenterChatView user={selectedUser} onMessageSent={refreshList} />
          </div>)
        : (<MessageCenterUserList
            selectedUserId={selectedUser?.userId}
            onSelect={setSelectedUser}
            onNewChat={() => setNewChatOpen(true)}
            refreshKey={refreshKey} />)}

      <MessageCenterNewChatDialog
        visible={newChatOpen}
        onHide={() => setNewChatOpen(false)}
        onSelectUser={(user) => { setSelectedUser(user); setNewChatOpen(false); }} />
    </div>);
};
export default CtcHeaderChatPanel;
