// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title RegulatedTWD
 * @notice 受監管台幣穩定幣(Demo,對標金管會《穩定幣專法》草案精神)。decimals = 6。
 *
 *  上鏈可查(Etherscan Read Contract)的合規揭露與控制:
 *   - 發行人揭露:issuerName / licenseNo / custodianBank / auditReportURI / termsURI
 *   - 100% 法幣儲備:reserveAttestedTWD、reserveRatioBps()(10000 = 100%)、isFullyReserved()
 *   - 儲備證明:attestReserves() 由 ATTESTOR 角色簽署 + ReserveAttested 事件 + 時間戳/文件雜湊
 *   - 持有人贖回權:requestRedemption()(燒幣換回法幣,記錄於鏈上)
 *   - 監管控制:pause()/unpause()(全面凍結流通)、setFrozen()(凍結個別地址)
 *   - 角色分權(AccessControl):發行人(admin)/ 儲備簽證人(attestor)/ 法遵(compliance)
 *
 *  注意:本合約為測試網 Demo,非真實合規發行;mintTWD 為公開水龍頭,領取時自動同步儲備以維持 100%。
 */
contract RegulatedTWD is ERC20, AccessControl, Pausable {
    bytes32 public constant ATTESTOR_ROLE = keccak256("ATTESTOR_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    // ---- 發行人揭露(公開可讀)----
    string public issuerName;
    string public licenseNo;
    string public custodianBank;
    string public auditReportURI;
    string public termsURI;

    // ---- 儲備證明 ----
    uint256 public reserveAttestedTWD;     // 已簽證之法幣儲備(6 位)
    uint64 public lastAttestationAt;       // 最後簽證時間
    bytes32 public lastAttestationDocHash; // 最後簽證文件雜湊(月報/審計)

    // ---- 凍結名單 ----
    mapping(address => bool) public frozen;

    // ---- 贖回紀錄 ----
    struct Redemption { address user; uint256 amount; uint64 at; bool settled; }
    Redemption[] public redemptions;

    event ReserveAttested(uint256 reserveTWD, bytes32 docHash, address indexed by, uint256 at);
    event RedemptionRequested(address indexed user, uint256 amount, uint256 indexed id);
    event AddressFrozen(address indexed account, bool frozen);
    event DisclosureUpdated();
    event Minted(address indexed to, uint256 amount);

    constructor(address admin) ERC20("Regulated Taiwan Dollar", "TWD") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ATTESTOR_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);

        issuerName = "FormosaX Trust (Demo Issuer)";
        licenseNo = "FSC-DEMO-2026-0001";
        custodianBank = "Bank of Taiwan (Demo Custodian)";
        auditReportURI = "ipfs://demo-monthly-reserve-attestation";
        termsURI = "https://formosax.demo/terms";
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    // ---- 發行人揭露(僅 admin)----
    function setDisclosure(
        string calldata issuerName_,
        string calldata licenseNo_,
        string calldata custodianBank_,
        string calldata auditReportURI_,
        string calldata termsURI_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        issuerName = issuerName_;
        licenseNo = licenseNo_;
        custodianBank = custodianBank_;
        auditReportURI = auditReportURI_;
        termsURI = termsURI_;
        emit DisclosureUpdated();
    }

    // ---- 儲備證明 ----
    function attestReserves(uint256 reserveTWD, bytes32 docHash) external onlyRole(ATTESTOR_ROLE) {
        reserveAttestedTWD = reserveTWD;
        lastAttestationAt = uint64(block.timestamp);
        lastAttestationDocHash = docHash;
        emit ReserveAttested(reserveTWD, docHash, msg.sender, block.timestamp);
    }

    /// @return 儲備覆蓋率(basis points,10000 = 100% 足額)
    function reserveRatioBps() public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 10000;
        return reserveAttestedTWD * 10000 / supply;
    }

    function isFullyReserved() external view returns (bool) {
        return reserveRatioBps() >= 10000;
    }

    function redemptionCount() external view returns (uint256) {
        return redemptions.length;
    }

    // ---- 監管控制 ----
    function pause() external onlyRole(COMPLIANCE_ROLE) { _pause(); }
    function unpause() external onlyRole(COMPLIANCE_ROLE) { _unpause(); }

    function setFrozen(address account, bool isFrozen) external onlyRole(COMPLIANCE_ROLE) {
        frozen[account] = isFrozen;
        emit AddressFrozen(account, isFrozen);
    }

    // ---- 公開水龍頭(Demo):領取時自動同步儲備以維持 100% ----
    function mintTWD(uint256 twdWhole) external whenNotPaused {
        uint256 amount = twdWhole * 10 ** 6;
        _mint(msg.sender, amount);
        reserveAttestedTWD += amount;
        lastAttestationAt = uint64(block.timestamp);
        emit Minted(msg.sender, amount);
        emit ReserveAttested(reserveAttestedTWD, lastAttestationDocHash, msg.sender, block.timestamp);
    }

    /// @notice 發行人鑄造(僅 admin),同步增提儲備
    function issue(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _mint(to, amount);
        reserveAttestedTWD += amount;
        emit Minted(to, amount);
    }

    // ---- 持有人贖回權:燒幣換回法幣(Demo 即時結算)----
    function requestRedemption(uint256 amount) external whenNotPaused returns (uint256 id) {
        require(amount > 0, "amount=0");
        _burn(msg.sender, amount);
        if (reserveAttestedTWD >= amount) reserveAttestedTWD -= amount;
        id = redemptions.length;
        redemptions.push(Redemption(msg.sender, amount, uint64(block.timestamp), true));
        emit RedemptionRequested(msg.sender, amount, id);
    }

    // ---- 凍結 / 暫停的轉帳攔截 ----
    function _update(address from, address to, uint256 value) internal override whenNotPaused {
        require(!frozen[from], "TWD: sender frozen");
        require(!frozen[to], "TWD: recipient frozen");
        super._update(from, to, value);
    }
}
