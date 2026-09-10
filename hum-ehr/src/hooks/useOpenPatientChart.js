import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPatientDetails } from '../services/patientService';

/**
 * Opens a patient's chart from anywhere outside the patient list (today: the
 * Message Center's Direct Address surface, where a message can be linked to a
 * patient).
 *
 * Legacy `initiateNavigatioToPatientChart` fetched the patient, wrote
 * `patientChartInformation` into sessionStorage and hard-navigated to
 * `/ehr/patients`. React keeps the chart tabs in App state, so instead we ask App
 * to open the tab (`hum-ehr:openPatientTab`, the counterpart of the existing
 * `hum-ehr:closePatientTab`) and route to /patients — no full page reload.
 *
 * @returns {(patientId: number|string) => Promise<void>}
 */
export const useOpenPatientChart = () => {
    const navigate = useNavigate();
    return useCallback(async (patientId) => {
        if (!patientId)
            return;
        const response = await fetchPatientDetails(patientId);
        if (response?.status !== 'success')
            throw new Error(response?.message || 'Failed to fetch the patient details.');
        const { patientId: id, patientName, genderCode } = response.data.patientDetails;
        window.dispatchEvent(new CustomEvent('hum-ehr:openPatientTab', {
            detail: { patientId: id, patientName, genderCode },
        }));
        navigate('/patients');
    }, [navigate]);
};
export default useOpenPatientChart;
