import { useCallback, useEffect, useRef, useState } from 'react';
import moment from '../../../utils/dayjs';
import { fetchPatientImmunizations } from '../../../services/immunizationService';
import { SkeletonList } from '../../../components/common/ContentLoader';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon, NotesMedicalIcon } from '../../../components/common/CustomIcons';
import DeletedRecordBadge from '../../../components/common/DeletedRecordBadge';

const relativeTime = (value) => {
    if (!value) return '';
    const parsed = moment(value, ['MM-DD-YYYY hh:mm A', 'MM-DD-YYYY', moment.ISO_8601], true);
    return parsed.isValid() ? parsed.fromNow() : value;
};

const PatientImmunizationList = ({ patientId, recordType, searchTerm, refreshKey, selectedId, onSelect }) => {
    const [records, setRecords] = useState(null); // null = fetching (skeleton)
    const { notifyError } = useNotify();
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;

    const loadList = useCallback(async (search) => {
        setRecords(null);
        try {
            const { records: list } = await fetchPatientImmunizations({ patientId, recordType, search });
            setRecords(list);
            onSelectRef.current?.(list[0] || null);
        }
        catch (error) {
            console.error('Failed to fetch immunization details.', error);
            setRecords([]);
            onSelectRef.current?.(null);
            // "Completed" (active) is the core list — surface its errors. "Scheduled"
            // is an optional backend capability that some deployments don't expose
            // (the /immunization/schedule route can 404); fall back to the empty
            // state quietly rather than alarming the user with a network error.
            if (recordType === 'active')
                notifyError(error?.message || 'Failed to fetch immunization details. Please try again.');
        }
    }, [patientId, recordType, notifyError]);

    useEffect(() => {
        const term = (searchTerm || '').trim();
        // Legacy only searches once >2 chars (otherwise shows the full list).
        const effective = term.length > 2 ? term : '';
        const timer = window.setTimeout(() => { loadList(effective); }, 350);
        return () => window.clearTimeout(timer);
    }, [searchTerm, refreshKey, loadList]);

    if (records === null)
        return <SkeletonList rows={5}/>;

    if (!records.length)
        return (<div className="list-wrapper pc-no-list-data-container">
          <div className="nodata d-flex justify-content-start align-items-center">
            <div className="me-2"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/></div>
            <div style={{ fontSize: 18 }}>Patient doesn't have any {recordType === 'active' ? 'active' : 'scheduled'} immunization yet!</div>
          </div>
        </div>);

    return (<>
      {records.map((record) => {
        const isActive = String(record.id) === String(selectedId);
        const name = (record.vaccineName || '').slice(0, 50) + ((record.vaccineName || '').length > 50 ? '...' : '');
        return (<div key={record.id} className={`row immunization-each-vaccine-detail-container pc-list-each-details-container ${isActive ? 'active' : ''} m-1 p-1`} data-id={record.id} onClick={() => onSelect(record)}>
            <div className="col-md-9 vaccine-name text-capitalize pe-0">
              {record.sourceType === 'CPLNEMR' && <span className="me-1 text-info" title="EMR Entry"><NotesMedicalIcon/></span>}
              {name}{record.invalidFlag === 'Y' && <DeletedRecordBadge />}
            </div>
            <div className="col-md-3 pe-0">
              <div className="vaccine-date pc-list-each-details-date-container">{recordType === 'active' ? relativeTime(record.administeredDate) : record.administeredDate}</div>
            </div>
          </div>);
      })}
    </>);
};
export default PatientImmunizationList;
