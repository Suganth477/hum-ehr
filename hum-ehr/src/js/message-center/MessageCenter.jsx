import { useMemo, useState } from 'react';
import MessageCenterChat from './MessageCenterChat';
import InAppMail from './InAppMail';
import { getLoggedInUser } from '../../services/authService';
import './MessageCenter.css';

// Legacy: Super Admin / Care Admin roles see only In-App Mail (chat hidden).
const CHAT_HIDDEN_ROLES = ['CMSSUPEADM', 'CMSCLINADM'];

/**
 * Message Center shell (legacy ehr-message-center.jsp + EhrTextMessageCenterSideMenu):
 * left icon menu toggles between Message Center Chat and In-App Mail.
 */
const MessageCenter = () => {
    const hideChat = useMemo(() => CHAT_HIDDEN_ROLES.includes(getLoggedInUser()?.roleCode), []);
    const [activeModule, setActiveModule] = useState(hideChat ? 'INAPPMAIL' : 'INAPPCHAT');

    return (<div id="eum_ehr_message_center_communication_main_container" className="container-fluid tab-content hh-ehr-bg-color9 p-0 mc-main-container">
      <div className="mc-communication-container" id="eum_ehr_message_center_communication_container">
        <div className="mc-side-menu">
          <ul className="mc-side-menu-list" role="tablist">
            {!hideChat && (
              <li className="mc-menu-list-item nav-item" role="presentation">
                <button type="button" className={`nav-link ${activeModule === 'INAPPCHAT' ? 'active' : ''}`} role="tab"
                  aria-selected={activeModule === 'INAPPCHAT'} onClick={() => setActiveModule('INAPPCHAT')}>
                  <span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 16" fill="#2E384D">
                      <path d="M1.5 2.25C1.5 1.83438 1.83438 1.5 2.25 1.5H10.75C11.1656 1.5 11.5 1.83438 11.5 2.25V7.75C11.5 8.16562 11.1656 8.5 10.75 8.5H6.75C6.60313 8.5 6.45625 8.54375 6.33437 8.625L4.5 9.85V9.25C4.5 8.83438 4.16563 8.5 3.75 8.5H2.25C1.83438 8.5 1.5 8.16562 1.5 7.75V2.25ZM2.25 0C1.00625 0 0 1.00625 0 2.25V7.75C0 8.99375 1.00625 10 2.25 10H3V11.25C3 11.5281 3.15312 11.7812 3.39687 11.9125C3.64062 12.0438 3.9375 12.0281 4.16563 11.875L6.97813 10H10.75C11.9937 10 13 8.99375 13 7.75V2.25C13 1.00625 11.9937 0 10.75 0H2.25ZM8 11.75C8 12.9937 9.00625 14 10.25 14H13.0219L15.8344 15.875C16.0656 16.0281 16.3594 16.0438 16.6031 15.9125C16.8469 15.7812 17 15.5281 17 15.25V14H17.75C18.9937 14 20 12.9937 20 11.75V6.25C20 5.00625 18.9937 4 17.75 4H14V5.5H17.75C18.1656 5.5 18.5 5.83437 18.5 6.25V11.75C18.5 12.1656 18.1656 12.5 17.75 12.5H16.25C15.8344 12.5 15.5 12.8344 15.5 13.25V13.85L13.6656 12.625C13.5437 12.5437 13.3969 12.5 13.25 12.5H10.25C9.83438 12.5 9.5 12.1656 9.5 11.75V11H8V11.75Z"/>
                    </svg>
                  </span>
                  <span className="mc-menu-desc">Message Center Chat</span>
                </button>
              </li>
            )}
            <li className="mc-menu-list-item nav-item" role="presentation">
              <button type="button" className={`nav-link ${activeModule === 'INAPPMAIL' ? 'active' : ''}`} role="tab"
                aria-selected={activeModule === 'INAPPMAIL'} onClick={() => setActiveModule('INAPPMAIL')}>
                <span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16" fill="#2E384D">
                    <path d="M2 3.49951C1.725 3.49951 1.5 3.72451 1.5 3.99951V4.69014L6.89062 9.11514C7.5375 9.64639 8.46562 9.64639 9.1125 9.11514L14.5 4.69014V3.99951C14.5 3.72451 14.275 3.49951 14 3.49951H2ZM1.5 6.63076V11.9995C1.5 12.2745 1.725 12.4995 2 12.4995H14C14.275 12.4995 14.5 12.2745 14.5 11.9995V6.63076L10.0625 10.2745C8.8625 11.2589 7.13438 11.2589 5.9375 10.2745L1.5 6.63076ZM0 3.99951C0 2.89639 0.896875 1.99951 2 1.99951H14C15.1031 1.99951 16 2.89639 16 3.99951V11.9995C16 13.1026 15.1031 13.9995 14 13.9995H2C0.896875 13.9995 0 13.1026 0 11.9995V3.99951Z"/>
                  </svg>
                </span>
                <span className="mc-menu-desc">In App Mail</span>
              </button>
            </li>
          </ul>
        </div>
        <div className="mc-communication-body">
          {activeModule === 'INAPPCHAT' && !hideChat && <MessageCenterChat/>}
          {activeModule === 'INAPPMAIL' && <InAppMail/>}
        </div>
      </div>
    </div>);
};
export default MessageCenter;
