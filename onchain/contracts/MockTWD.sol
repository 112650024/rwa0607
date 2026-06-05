// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockTWD
 * @notice 平台計價穩定幣(Demo)。decimals = 6。任何人可領(水龍頭),方便展示。
 */
contract MockTWD is ERC20 {
    event Minted(address indexed to, uint256 amount);

    constructor() ERC20("Mock Taiwan Dollar", "TWD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice 傳「顆」(整數 TWD),合約內部 ×1e6
    function mintTWD(uint256 twdWhole) external {
        uint256 amount = twdWhole * 10 ** 6;
        _mint(msg.sender, amount);
        emit Minted(msg.sender, amount);
    }

    /// @notice 傳原始量(6 位)
    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
        emit Minted(msg.sender, amount);
    }
}
