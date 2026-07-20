import { useCallback, useEffect, useRef, useState } from 'react';
import moment from '../../../utils/dayjs';
import { fetchImplantDeviceList } from '../../../services/implantDeviceService';
import { SkeletonList } from '../../../components/common/ContentLoader';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { useNotify } from '../../../context/NotificationContext';

const dateOnly = (value) => (value ? moment(value).format('MM-DD-YYYY') : '');
const truncate = (value, max = 40) => {
    const text = value || '';
    return text.length > max ? `${text.slice(0, max)}...` : text;
};

/**
 * Left-pane list for the active/inactive/marked-as-error tabs. Mirrors
 * PatientImplantableDeviceList: fetch by activeFlag/invalidFlag/search, auto-select
 * the first row, and surface the backend's pendingVerificationFlag to the container.
 */
const PatientImplantableDeviceList = ({ patientId, recordType, invalidFlag, searchTerm, refreshKey, selectedId, onSelect, onPending }) => {
    const [records, setRecords] = useState(null); // null = fetching (skeleton)
    const [searched, setSearched] = useState(false);
    const { notifyError } = useNotify();
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const onPendingRef = useRef(onPending);
    onPendingRef.current = onPending;

    const loadList = useCallback(async (search) => {
        setRecords(null);
        try {
            const { records: list, pendingVerificationFlag } = await fetchImplantDeviceList({ patientId, recordType, search, invalidFlag });
            setRecords(list);
            setSearched(!!search);
            onSelectRef.current?.(list[0] || null);
            if (pendingVerificationFlag === 'Y') onPendingRef.current?.();
        }
        catch (error) {
            console.error('Failed to fetch implanted device details.', error);
            setRecords([]);
            setSearched(!!search);
            onSelectRef.current?.(null);
            notifyError(error?.message || 'Failed to fetch implanted device details.');
        }
    }, [patientId, recordType, invalidFlag, notifyError]);

    useEffect(() => {
        const term = (searchTerm || '').trim();
        // Legacy only searches once >2 chars (otherwise shows the full list).
        const effective = term.length > 2 ? term : '';
        const timer = window.setTimeout(() => { loadList(effective); }, 350);
        return () => window.clearTimeout(timer);
    }, [searchTerm, refreshKey, loadList]);

    if (records === null)
        return <SkeletonList rows={5}/>;

    if (!records.length) {
        let message;
        if (searched) message = 'No matching records found';
        else if (invalidFlag === 'Y') message = 'No devices are marked as error for the patient!';
        else message = `Patient doesn't have any ${recordType === 'history' ? 'inactive' : 'active'} implantable device yet!`;
        return (<div className="list-wrapper pc-no-list-data-container" style={{ color: '#9e9b9b' }}>
          <div className="nodata d-flex justify-content-start align-items-center">
            <div className="me-2"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/></div>
            <div style={{ fontSize: 18 }}>{message}</div>
          </div>
        </div>);
    }

    return (<>
      {records.map((record) => {
        const isActive = String(record.id) === String(selectedId);
        const label = truncate(record.deviceName || record.deviceType);
        const date = invalidFlag === 'Y' ? dateOnly(record.markedAsErrorDate)
            : (recordType === 'active' ? dateOnly(record.implantDate) : dateOnly(record.explantDate));
        return (<div key={record.id} className={`implantable-each-device-detail-container pc-list-each-details-container ${isActive ? 'active' : ''} ${invalidFlag === 'Y' ? 'in-active-deleted-record' : ''} m-1 p-2`} data-id={record.id} onClick={() => onSelect(record)}>
            <div className="implant-device-name text-capitalize">{label}</div>
            <div className="implant-device-date pc-list-each-details-date-container mt-1">{date}</div>
          </div>);
      })}
    </>);
};
export default PatientImplantableDeviceList;
