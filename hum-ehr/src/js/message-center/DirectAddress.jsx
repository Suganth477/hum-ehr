import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUserDirectAddressList } from '../../services/directAddressService';
import { useNotify } from '../../context/NotificationContext';
import { SkeletonList } from '../../components/common/ContentLoader';
import { LegacyIcon } from '../../components/common/CustomIcons';
import DirectAddressMessageList from './DirectAddressMessageList';
import {
    DIRECT_ADDRESS_LIST_KEY, consolidateDirectAddresses, directAddressLabel, isProviderAddress,
} from './directAddressHelpers';
import './DirectAddress.css';

/**
 * Direct Address surface (legacy EhrDirectAdressMainElement).
 *
 * The user can own several direct mailboxes — their personal physician address and
 * one per facility — so the surface opens with a mailbox picker over the message
 * list. Selecting a mailbox re-mounts the list for that `directAddressId`.
 *
 * The picker hides while a conversation or the composer is open, matching the
 * legacy `EhrDirectAddressMainElement:toggleDirectAddressDropDown` behaviour.
 */
const DirectAddress = () => {
    const { notifyError } = useNotify();
    const [selectedId, setSelectedId] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: DIRECT_ADDRESS_LIST_KEY,
        queryFn: fetchUserDirectAddressList,
    });

    useEffect(() => {
        if (isError) {
            console.error('Failed to get User Direct Address Details', error);
            notifyError(error?.message || 'Failed to get User Direct Address Details');
        }
    }, [isError, error, notifyError]);

    const addresses = useMemo(() => consolidateDirectAddresses(data?.data), [data]);

    // Default to the first mailbox (legacy assigns directAddressMailConsolidatedList[0]).
    useEffect(() => {
        if (addresses.length && !addresses.some((a) => a.directAddressId === selectedId))
            setSelectedId(addresses[0].directAddressId);
    }, [addresses, selectedId]);

    const selected = addresses.find((a) => a.directAddressId === selectedId) || null;

    if (isLoading)
        return <div className="eda-container p-3"><SkeletonList rows={6} /></div>;

    if (!addresses.length)
        return (<div className="eda-container">
          <div className="nodata eda-nodata">No direct address is configured for your account.</div>
        </div>);

    return (<div className="eda-container">
      {/* Legacy `eda-direct-address-list-dropdown` — a native Bootstrap dropdown
          (`data-bs-toggle`), per the project's "native Bootstrap JS, no react-bootstrap"
          decision. Bootstrap's bundle is imported once in main.jsx, so no JS wiring
          or outside-click handling is needed here. */}
      {!detailOpen && (
        <div className="row m-0 p-0 eda-direct-address-list-dropdown pt-2">
          <div className="eda-ehr-direct-address-list-dropdown-container">
            <div className="dropdown eda-ehr-direct-address-list-dropdown">
              <button className="btn eda-ehr-direct-address-list-dropdown-button dropdown-toggle" type="button"
                data-bs-toggle="dropdown" aria-expanded="false">
                <span className="eda-direct-address-id-icon p-1">
                  <LegacyIcon icon={isProviderAddress(selected) ? 'fa-user' : 'fa-hospital'} />
                </span>
                {directAddressLabel(selected)}
              </button>
              <ul className="dropdown-menu eda-ehr-direct-address-list-dropdown-menu">
                {addresses.map((address) => (
                  <li key={address.directAddressId}>
                    <button type="button"
                      className={`dropdown-item ehr-eda-direct-address-mail-id ${address.directAddressId === selectedId ? 'active' : ''}`}
                      onClick={() => setSelectedId(address.directAddressId)}>
                      <LegacyIcon icon={isProviderAddress(address) ? 'fa-user' : 'fa-hospital'} className="me-2" />
                      {directAddressLabel(address)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <DirectAddressMessageList
          key={selected.directAddressId}
          directAddress={selected}
          onDetailOpenChange={setDetailOpen} />
      )}
    </div>);
};
export default DirectAddress;
