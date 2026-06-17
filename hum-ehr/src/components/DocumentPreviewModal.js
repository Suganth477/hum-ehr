import React from "react";
import { base64ToBlobUrl } from "../utils/commonUtility";

const DocumentPreviewModal = ({ visible, fileDetails, onClose }) => {
	if (!visible || !fileDetails) return null;

	const { encodedData, fileFormat, fileName } = fileDetails;

	// Resolve correct content application headers maps
	const getMimeType = (format) => {
		const ext = format?.toLowerCase();
		if (["jpg", "jpeg", "png"].includes(ext))
			return `image/${ext === "jpg" ? "jpeg" : ext}`;
		if (ext === "pdf") return "application/pdf";
		return "application/octet-stream";
	};

	const mimeType = getMimeType(fileFormat);
	const blobURL = base64ToBlobUrl(encodedData, mimeType);
	const isImage = mimeType.startsWith("image/");

	return (
		<div
			className="modal fade show d-block"
			id="patient_chart_document_view_common_xl_modal"
			tabIndex="-1"
			role="dialog"
			style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
		>
			<div
				className="modal-dialog modal-dialog-centered modal-xl"
				role="document"
			>
				<div className="modal-content shadow border-0">
					<div className="modal-header bg-primary text-white py-2 px-3">
						<h5
							className="modal-title"
							id="patient_chart_document_name_common_modal"
						>
							{mimeType === "application/pdf" ? "View Report" : "View Image"} -{" "}
							{fileName}
						</h5>
						<button
							type="button"
							className="btn-close btn-close-white"
							onClick={onClose}
							aria-label="Close"
						></button>
					</div>
					<div className="modal-body p-0 bg-light">
						<div
							className="modal-view-container d-flex align-items-center justify-content-center"
							style={{ width: "100%", height: "580px" }}
						>
							{isImage ? (
								<img
									src={blobURL}
									alt={fileName}
									className="img-fluid max-height-100 shadow-sm"
									style={{ maxHeight: "100%", maxWidth: "100%" }}
								/>
							) : mimeType === "application/pdf" ? (
								<iframe
									src={`${blobURL}#toolbar=0`}
									width="100%"
									height="100%"
									title={fileName}
									className="border-0"
								/>
							) : (
								<div className="text-center p-4">
									<span className="mdi mdi-file-download-outline display-1 text-muted d-block mb-3"></span>
									<p className="mb-3 fw-medium">
										Preview unavailable for this format type config.
									</p>
									<a
										href={blobURL}
										download={fileName}
										className="btn btn-primary rounded-pill px-4"
									>
										Download Resource File
									</a>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default DocumentPreviewModal;
