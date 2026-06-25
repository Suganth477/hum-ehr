import { useEhrNativeInteractions } from '../hooks/useEhrNativeInteractions';
const EhrSystemNotificationsBanner = () => {
    const { infoBannerVisible, dismissInfoBanner } = useEhrNativeInteractions();
    if (!infoBannerVisible)
        return null;
    return (<div id="application_info_container" className="px-3 py-2 text-center text-bold skippy hh-ehr-bg-color1 d-flex align-items-center justify-content-center position-relative">
      <p className="hh-ehr-color1 text-decoration-none mb-0">This is a newer version of Humhealth!</p>
      <span className="app-info-close-icon mdi mdi-close-circle-outline position-absolute style-pointer" onClick={dismissInfoBanner} style={{ right: '15px', cursor: 'pointer' }}/>
    </div>);
};
export default EhrSystemNotificationsBanner;
