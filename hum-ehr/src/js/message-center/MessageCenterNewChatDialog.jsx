import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { useVirtualizer } from '@tanstack/react-virtual';
import { fetchContactUsers } from '../../services/messageCenterService';
import { SkeletonList } from '../../components/common/ContentLoader';
import { useNotify } from '../../context/NotificationContext';
import { LegacyIcon } from '../../components/common/CustomIcons';

// Role filter tabs (legacy chat.jsp .ctc-chat-new-recipient-role-filter).
const ROLE_FILTERS = [
    { key: '', label: 'All' },
    { key: 'CMSPATIENT', label: 'Patient' },
    { key: 'CMSPHYSICI', label: 'Provider' },
    { key: 'CMSCLINICI', label: 'Staff / Nurse' },
];

/** Map a contact record to the `user` shape MessageCenterChatView consumes. */
const toChatUser = (contact) => {
    const parts = String(contact.fullName || '').trim().split(' ').filter(Boolean);
    const lastName = parts.length ? parts[parts.length - 1] : '';
    return {
        userId: contact.userId,
        userName: contact.fullName || '',
        userRole: contact.role || '',
        userDob: contact.dob || '',
        userGender: contact.genderDesc || '',
        userPersonId: contact.personId || '',
        firstName: contact.fullName || '', // legacy uses fullName; initials take first+last char
        lastName,
        isMessageSentFlag: '', // brand-new conversation → not deactivated
    };
};

const contactInitials = (fullName) => {
    const parts = String(fullName || '').trim().split(' ').filter(Boolean);
    return `${(parts[0] || '?')[0] || ''}${(parts[parts.length - 1] || '')[0] || ''}`.toUpperCase();
};

/**
 * New Chat contact search (legacy chat.window.js _showSearchNewRecipientScreen +
 * _displayLoggedInUserContactList). Debounced name search + role filter over the
 * standard backend contact list; selecting a contact opens a fresh conversation.
 */
const MessageCenterNewChatDialog = ({ visible, onHide, onSelectUser }) => {
    const { notifyError } = useNotify();
    const [search, setSearch] = useState('');
    const [role, setRole] = useState('');
    const [contacts, setContacts] = useState(null); // null = loading
    const [counts, setCounts] = useState({ filtered: 0, total: 0 });
    const debounceRef = useRef(null);
    const listRef = useRef(null);

    // Virtualize the contact list — the search can return well over 100 rows.
    const rowVirtualizer = useVirtualizer({
        count: contacts?.length || 0,
        getScrollElement: () => listRef.current,
        estimateSize: () => 56,
        overscan: 8,
    });

    const load = useCallback(async (term, roleFilter) => {
        setContacts(null);
        try {
            const response = await fetchContactUsers({ search: term, role: roleFilter });
            if (response?.status === 'success') {
                const list = response.data?.contactList || {};
                setCounts({ filtered: list.filteredCount || 0, total: list.totalCount || 0 });
                setContacts(list.contactdetails || []);
            }
            else setContacts([]);
        }
        catch (error) {
            console.error('Failed to fetch the list of users.', error);
            setContacts([]);
            notifyError(error?.message || 'Failed to fetch the list of users. Please try again.');
        }
    }, [notifyError]);

    // Fetch on open and whenever the role filter changes; reset everything on close.
    useEffect(() => {
        if (!visible) {
            setSearch(''); setRole(''); setContacts(null); setCounts({ filtered: 0, total: 0 });
            return;
        }
        load(search.trim(), role);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, role, load]);

    const onSearchChange = (value) => {
        setSearch(value);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => load(value.trim(), role), 500);
    };
    useEffect(() => () => clearTimeout(debounceRef.current), []);

    return (
      <Dialog header="New Chat" visible={visible} onHide={onHide} style={{ width: '32rem' }} breakpoints={{ '768px': '95vw' }} dismissableMask>
        <div className="mc-newchat">
          <div className="icon-input-group position-relative mb-2">
            <input type="text" className="form-control text-capitalize mc-chat-user-search" placeholder="Search by name"
              value={search} onChange={(e) => onSearchChange(e.target.value)}/>
            <LegacyIcon icon="mdi-magnify" style={{ position: 'absolute', right: 14, top: 8 }}/>
          </div>

          <ul className="mc-newchat-role-filter">
            {ROLE_FILTERS.map((r) => (
              <li key={r.key || 'all'} className={role === r.key ? 'active' : ''} role="button" onClick={() => setRole(r.key)}>{r.label}</li>
            ))}
          </ul>

          {contacts !== null && (
            <div className="mc-newchat-count text-center">Showing {counts.filtered} of {counts.total} entries</div>
          )}

          <div className="mc-newchat-list custom-scrollbar" ref={listRef}>
            {contacts === null && <div className="p-2"><SkeletonList rows={6}/></div>}
            {contacts !== null && contacts.length === 0 && <div className="nodata text-center py-3">No records found</div>}
            {contacts !== null && contacts.length > 0 && (
              <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
                {rowVirtualizer.getVirtualItems().map((vRow) => {
                  const contact = contacts[vRow.index];
                  return (
                    <div key={`${contact.userId}_${vRow.index}`} className="mc-newchat-user" role="button"
                      ref={rowVirtualizer.measureElement} data-index={vRow.index}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}
                      onClick={() => onSelectUser(toChatUser(contact))}>
                      <span className="mc-chat-user-icon text-uppercase">{contactInitials(contact.fullName)}</span>
                      <div className="mc-chat-user-details">
                        <p className="mb-0 text-capitalize" style={{ color: '#37474F' }}><b>{contact.fullName}</b></p>
                        <p className="mb-0" style={{ color: '#526172', fontSize: '0.85rem' }}>{contact.role}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Dialog>
    );
};
export default MessageCenterNewChatDialog;
