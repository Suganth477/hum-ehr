import moment from '../../../utils/dayjs';
import { deleteSurgicalHistory, fetchSurgicalHistoryReport } from '../../../services/surgicalHistoryService';
import { getFormattedIcdCode } from '../../../utils/commonUtility';
import { FileTiles } from '../procedure/PatientProcedureDetails';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';

const dateOnly = (value) => {
    if (!value) return '';
    const parsed = moment(value, ['MM-DD-YYYY hh:mm A', 'MM-DD-YYYY', moment.ISO_8601], true);
    return parsed.isValid() ? parsed.format('MM-DD-YYYY') : value;
};

/**
 * Surgical history detail pane (legacy patient-surgical-history-view-details): title +
 * Edit/Delete (hidden for deleted records), surgery date/surgeon/location/body-site,
 * numbered reason-for-surgery diagnoses, notes, and report file tiles.
 */
const PatientSurgicalHistoryViewDetails = ({ patientId, record, onEdit, onDeleted }) => {
    const { notifyError, notifySuccess } = useNotify();

    if (!record)
        return (<div className="list-wrapper pc-no-list-data-container mt-0">
          <div className="nodata d-flex justify-content-start align-items-center">
            <div className="me-2"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/></div>
            <div style={{ fontSize: 18 }}>Patient doesn't have any surgical history yet!</div>
          </div>
        </div>);

    const invalid = record.invalidFlag === 'Y';

    const handleDelete = async () => {
        if (!window.confirm('Are you sure about deleting the surgical history?')) return;
        try {
            const response = await deleteSurgicalHistory({ patientId, careplanId: record.careplanId, surgeryId: record.id, surgeryName: record.surgeryName });
            if (!response || response.status === 'success') { notifySuccess('Surgical history deleted successfully.'); onDeleted(); }
            else notifyError(response.message || 'Failed to delete surgical history the record. Please try again.');
        }
        catch (error) {
            console.error('Failed to delete surgical history record.', error);
            notifyError(error?.message || 'Failed to delete surgical history the record. Please try again.');
        }
    };

    return (<div className="surgical-history-details-main-container show-details-main-container">
      <div className="d-flex justify-content-between align-items-center mb-3 mx-3">
        <div><span className="pcps-suh-record-info-name-title text-capitalize">{record.surgeryName}</span></div>
        {!invalid && (<div className="d-flex gap-3 justify-content-end">
          <button type="button" className="pcps-record-action-btn" title="Edit" onClick={() => onEdit(record)}><LegacyIcon icon="fa-pencil"/> Edit</button>
          <button type="button" className="pcps-record-action-btn" title="Delete" onClick={handleDelete}><LegacyIcon icon="fa-trash-can"/></button>
        </div>)}
      </div>
      <div className="surgical-record-info-container custom-scrollbar">
        <div className={`row mx-3 my-4 ${invalid ? 'deleted-surgical-history-record' : ''}`}>
          <div className="col-md-3"><div className="label">Surgery Date</div><div className="fw-bold label-name text-capitalize">{dateOnly(record.surgeryDateTime) || '-'}</div></div>
          <div className="col-md-3"><div className="label">Surgeon</div><div className="fw-bold label-name text-capitalize">{record.surgeonName || '-'}</div></div>
          <div className="col-md-3"><div className="label">Surgery Location</div><div className="fw-bold label-name text-capitalize">{record.surgeonFacilityName || '-'}</div></div>
          <div className="col-md-3"><div className="label">Body Site</div><div className="fw-bold label-name">{record.bodysiteDescription || '-'}</div></div>
        </div>
        <div className={`row mx-3 my-4 ${invalid ? 'deleted-surgical-history-record' : ''}`}>
          <div className="col-md-12">
            <div className="label">Reason for Surgery</div>
            <div className="fw-bold label-name">
              {record.diagnosisList && record.diagnosisList.length
                ? record.diagnosisList.map((d, index) => (
                    <div key={index} className="my-2 d-flex align-items-center gap-2">
                      <span>{index + 1})</span>
                      <div style={{ color: '#3C6691' }}>{getFormattedIcdCode(d.icdCode || '')} -&nbsp;</div>
                      <div>{d.longDescription || d.snomedCode}</div>
                    </div>
                  ))
                : '-'}
            </div>
          </div>
        </div>
        <div className={`row mx-3 my-4 ${invalid ? 'deleted-surgical-history-record' : ''}`}>
          <div className="col-md-12"><div className="label">Note</div><div className="fw-bold label-name">{record.notes || '-'}</div></div>
        </div>
        <div className="row mx-3 my-4">
          <div className="col-md-12">
            <div className="label">Surgical Report</div>
            <div className="my-3">
              <FileTiles files={record.fileDetail} fetchReport={fetchSurgicalHistoryReport} disabled={invalid} notifyError={notifyError}/>
            </div>
          </div>
        </div>
      </div>
    </div>);
};
export default PatientSurgicalHistoryViewDetails;
