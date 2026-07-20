import { useCallback, useEffect, useState } from 'react';
import { getPatientDetails } from '../../../services/patientProfileService';
import PatientPhoneInformationEdit from './PatientPhoneInformationEdit';
import { SkeletonViewDetails } from '../../../components/common/ContentLoader';
import { LegacyIcon } from '../../../components/common/CustomIcons';

const VerifiedBadge = ({ show, invalid }) => (show ? (
    <svg viewBox="0 0 24 24" className="pp-verified-icon" fill={invalid === 'Y' ? 'red' : 'green'}>
      <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.11 18 22 17.11 22 16V4C22 2.89 21.1 2 20 2M10.47 14L7 10.5L8.4 9.09L10.47 11.17L15.6 6L17 7.41L10.47 14Z"/>
    </svg>
) : null);

const Field = ({ label, value, badge = null }) => (
    <div className="col-md-3 col-6 mb-3">
      <div className="pp-label d-flex align-items-center gap-2">{label}{badge}</div>
      <div className="fw-bold">{value || '-'}</div>
    </div>
);

/**
 * Communication Information (legacy patient-phone-information-view/edit swap).
 */
const PatientPhoneInformation = ({ patientId, onEditingChange }) => {
    // undefined = fetching (skeleton), null = fetch failed.
    const [details, setDetails] = useState(undefined);
    const [editing, setEditing] = useState(false);

    const load = useCallback(async () => {
        setDetails(undefined);
        try { setDetails((await getPatientDetails(patientId)) || null); }
        catch (error) { console.error('Failed to fetch patient phone details.', error); setDetails(null); }
    }, [patientId]);
    useEffect(() => { load(); }, [load]);

    const openEdit = () => { setEditing(true); onEditingChange?.(true); };
    const closeEdit = (didSave) => {
        setEditing(false);
        onEditingChange?.(false);
        if (didSave) load();
    };

    if (details === undefined) return <SkeletonViewDetails rows={3} cols={3}/>;
    if (!details) return <div className="alert alert-warning">Patient data unavailable.</div>;
    if (editing) return <PatientPhoneInformationEdit patientId={patientId} onClose={closeEdit}/>;

    return (<div>
      <div className="pp-detail-card p-2">
        <div className="row ms-1 my-1">
          <Field label="Primary Communication" value={details.primaryCommunicationDesc}/>
          <Field label="Secondary Communication" value={details.secondaryCommunicationDesc}/>
          <div className="col-md-5 offset-md-1 d-flex justify-content-md-end align-items-start">
            <button type="button" className="btn pp-edit-btn mt-2" title="Edit Patient Contact" onClick={openEdit}>
              <LegacyIcon icon="mdi-pencil" className="me-1"/>Edit
            </button>
          </div>
        </div>
      </div>

      <div className="pp-detail-card mt-3 p-2">
        <div className="fw-bold ms-1 mb-2"><LegacyIcon icon="fa-phone" className="me-2"/>Patient Contact</div>
        <div className="row ms-1 my-1">
          <Field label="Mobile Phone" value={details.mobilePhone} badge={<VerifiedBadge show={!!details.mobilePhone} invalid={details.mobilePhoneInvalidFlag}/>}/>
          <Field label="Home Phone" value={details.homePhone} badge={<VerifiedBadge show={!!details.homePhone} invalid={details.pagerPhoneInvalidFlag}/>}/>
          <Field label="Work Phone" value={details.workPhone} badge={<VerifiedBadge show={!!details.workPhone} invalid={details.workPhoneInvalidFlag}/>}/>
        </div>
        <div className="row ms-1 my-1">
          <Field label="Other Phone" value={details.otherPhone} badge={<VerifiedBadge show={!!details.otherPhone} invalid={details.otherPhoneInvalidFlag}/>}/>
          <Field label="Fax" value={details.faxPhone}/>
          <Field label="Email" value={details.email}/>
        </div>
      </div>

      <div className="pp-detail-card mt-3 p-2">
        <div className="fw-bold ms-1 mb-2"><LegacyIcon icon="fa-message" className="me-2"/>Text Message</div>
        <div className="row ms-1 my-1">
          <Field label="Disabled Text Message Feature" value={details.phoneNumberStatus === 'PTVALID' ? 'No' : 'Yes'}/>
          <Field label="Text Message Consent Type" value={details.phoneNumberStatus === 'PTVALID' ? (details.verificationType === 'VERBVERIF' ? 'Verbal' : 'OTP Verification') : '-'}/>
        </div>
      </div>
    </div>);
};
export default PatientPhoneInformation;
