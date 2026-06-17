import React, { useEffect, useState } from 'react';
import doctorImage from '../../assets/images/doctor.jpeg';
import { downloadPatientCCD, fetchPatientDetails } from '../../services/patientService';

const patientCache = window.patientCache || {};
window.patientCache = patientCache;

const getGenderIcon = (genderCode = '') => {
	const code = String(genderCode).toUpperCase();
	if (code === 'F' || code === 'FEMALE') return 'female';
	if (code === 'M' || code === 'MALE') return 'male';
	return 'transgender';
};

const calculateAge = (dateOfBirth) => {
	if (!dateOfBirth) return '';
	const birthday = new Date(dateOfBirth);
	if (Number.isNaN(birthday.getTime())) return '';

	const today = new Date();
	let age = today.getFullYear() - birthday.getFullYear();
	const monthDiff = today.getMonth() - birthday.getMonth();
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) age -= 1;
	return age;
};

const formatAddress = (patientDetails) => {
	const parts = [
		patientDetails.addressLineOne,
		patientDetails.addressLineTwo,
		patientDetails.city,
		patientDetails.state,
		patientDetails.zipCode,
	];
	return parts.filter((part) => String(part || '').trim()).join(', ');
};

const savePatientContextCache = (patientId, data) => {
	patientCache[`${patientId}_details`] = data.patientDetails;
	patientCache[`${patientId}_subscribedProducts`] = data.subscribedProducts;
	patientCache[`${patientId}_sdohHistory`] = data.sdohVisitHisotryDetails;
};

const PatientDemographics = ({ patientId }) => {
	const [patientDetails, setPatientDetails] = useState(null);
	const [loading, setLoading] = useState(true);
	const [isDownloading, setIsDownloading] = useState(false);

	useEffect(() => {
		let ignore = false;

		const loadPatientDetails = async () => {
			if (!patientId) return;
			const cachedPatient = patientCache[`${patientId}_details`];
			if (cachedPatient) {
				setPatientDetails(cachedPatient);
				setLoading(false);
				return;
			}

			setLoading(true);
			try {
				const response = await fetchPatientDetails(patientId);
				if (!ignore && response?.status === 'success') {
					savePatientContextCache(patientId, response.data || {});
					setPatientDetails(response.data?.patientDetails || null);
				}
			} catch (error) {
				console.error('Failed to fetch patient details.', error);
			} finally {
				if (!ignore) setLoading(false);
			}
		};

		loadPatientDetails();
		return () => { ignore = true; };
	}, [patientId]);

	const handleDownloadCCD = async () => {
		setIsDownloading(true);
		try {
			const blob = await downloadPatientCCD(patientId);
			const downloadUrl = window.URL.createObjectURL(blob);
			const hyperlink = document.createElement('a');
			hyperlink.href = downloadUrl;
			hyperlink.download = `pat_${patientId}.xml`;
			document.body.appendChild(hyperlink);
			hyperlink.click();
			hyperlink.remove();
			window.URL.revokeObjectURL(downloadUrl);
		} catch (error) {
			console.error('Failed to download CCD file.', error);
		} finally {
			setIsDownloading(false);
		}
	};

	if (loading) return <div className="p-3 text-muted small">Loading demographics...</div>;
	if (!patientDetails) return <div className="alert alert-warning m-2">Patient data unavailable.</div>;

	const age = calculateAge(patientDetails.dateOfBirth);
	const address = formatAddress(patientDetails);

	return (
		<div className="patient-demographics-container-node">
			<div className="pd-patient-demographics-main-container">
				<div className="pd-patient-profile-picture">
					<img className="pd-patient-image profile-image" src={doctorImage} alt="Profile Thumbnail" />
				</div>

				<div className="pd-patient-demographics-details">
					<div className="pd-patient-demographics-list">
						<div className="pd-patient-demographics-list-item">
							<span className="pd-patient-demographics-icon" />
							<span className="pd-patient-demographics-data text-capitalize patient-name">{patientDetails.patientName}</span>
						</div>

						<div className="pd-patient-demographics-list-item">
							<span className="pd-patient-demographics-icon mdi mdi-calendar-month-outline" />
							<span className="pd-patient-demographics-data">
								{patientDetails.dateOfBirth}{age !== '' ? ` (${age}yrs)` : ''}
							</span>
						</div>

						<div className="pd-patient-demographics-list-item">
							<span className={`pd-patient-demographics-icon mdi mdi-gender-${getGenderIcon(patientDetails.gender)}`} />
							<span className="pd-patient-demographics-data">{patientDetails.genderDesc}</span>
						</div>

						<div className="pd-patient-demographics-list-item">
							<span className="pd-patient-demographics-icon" />
							<span className="pd-patient-demographics-data font-monospace">{patientDetails.ehrEmrId}</span>
						</div>

						{patientDetails.mobilePhoneNumber && (
							<div className="pd-patient-demographics-list-item">
								<span className="pd-patient-demographics-icon mdi mdi-phone-outline" />
								<span className="pd-patient-demographics-data">{patientDetails.mobilePhoneNumber} (M)</span>
							</div>
						)}

						<div className="pd-patient-demographics-list-item">
							<span className="pd-patient-demographics-icon mdi mdi-email-outline" />
							<span className="pd-patient-demographics-data">{patientDetails.email || ''}</span>
						</div>

						<div className="pd-patient-demographics-list-item">
							<span className="pd-patient-demographics-icon mdi mdi-home-outline" />
							<span className="pd-patient-demographics-data">{address}</span>
						</div>
					</div>

					<div className="pd-patient-demographics-ccd-generation-container ms-auto" style={{ marginRight: '1rem' }}>
						<button
							type="button"
							className="btn btn-primary border-radius-button d-flex align-items-center gap-2 text-nowrap"
							disabled={isDownloading}
							onClick={handleDownloadCCD}
							style={{ width: 'max-content' }}
						>
							<span className="mdi mdi-download" />
							{isDownloading ? 'Downloading...' : 'Download CCD'}
						</button>
					</div>

					<div className="pd-patient-demographics-icons">
						<span className="mdi mdi-dots-vertical action-group-icon" data-bs-toggle="dropdown" data-bs-auto-close="true" />
						<ul className="dropdown-menu shadow border-0">
							<li><button className="dropdown-item small" type="button">Edit Core Demographics</button></li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
};

export default PatientDemographics;
