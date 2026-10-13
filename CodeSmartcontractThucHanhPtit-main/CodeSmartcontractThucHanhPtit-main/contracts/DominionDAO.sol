// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract DominionDAO is ReentrancyGuard, AccessControl {
    bytes32 private immutable CONTRIBUTOR_ROLE =
        keccak256("CONTRIBUTOR");

    bytes32 private immutable STAKEHOLDER_ROLE =
        keccak256("STAKEHOLDER");

    uint256 immutable MIN_STAKEHOLDER_CONTRIBUTION = 0.01 ether;
    uint32 immutable MIN_VOTE_DURATION = 5 minutes;

    uint256 totalProposals;
    uint256 public daoBalance;

    mapping(uint256 => ProposalStruct) private raisedProposals;
    mapping(address => uint256[]) private stakeholderVotes;
    mapping(uint256 => VotedStruct[]) private votedOn;
    mapping(address => uint256) private contributors;
    mapping(address => uint256) private stakeholders;

    struct ProposalStruct {
        uint256 id;
        uint256 amount;
        uint256 duration;
        uint256 upvotes;
        uint256 downvotes;
        string title;
        string description;
        bool passed;
        bool paid;
        address payable beneficiary;
        address proposer;
        address executor;
    }

    struct VotedStruct {
        address voter;
        uint256 timestamp;
        bool choosen;
    }

    event Action(
        address indexed initiator,
        bytes32 role,
        string message,
        address indexed beneficiary,
        uint256 amount
    );

    modifier stakeholderOnly(string memory message) {
        require(
            hasRole(STAKEHOLDER_ROLE, msg.sender),
            message
        );
        _;
    }

    modifier contributorOnly(string memory message) {
        require(
            hasRole(CONTRIBUTOR_ROLE, msg.sender),
            message
        );
        _;
    }

    // Tao de xuat
    function createProposal(
        string calldata title,
        string calldata description,
        address beneficiary,
        uint256 amount
    )
        external
        stakeholderOnly(
            "Proposal Creation Allowed for Stakeholders only"
        )
        returns (ProposalStruct memory)
    {
        uint256 proposalId = totalProposals++;
        ProposalStruct storage proposal =
            raisedProposals[proposalId];

        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.title = title;
        proposal.description = description;
        proposal.beneficiary = payable(beneficiary);
        proposal.amount = amount;
        proposal.duration = block.timestamp + MIN_VOTE_DURATION;

        emit Action(
            msg.sender,
            CONTRIBUTOR_ROLE,
            "PROPOSAL RAISED",
            beneficiary,
            amount
        );

        return proposal;
    }

    // Bieu quyet cho de xuat
    function performVote(
        uint256 proposalId,
        bool choosen
    )
        external
        stakeholderOnly("Unauthorized: Stakeholders only")
        returns (VotedStruct memory)
    {
        ProposalStruct storage proposal =
            raisedProposals[proposalId];

        handleVoting(proposal);

        if (choosen) {
            proposal.upvotes++;
        } else {
            proposal.downvotes++;
        }

        stakeholderVotes[msg.sender].push(proposal.id);

        votedOn[proposal.id].push(
            VotedStruct(
                msg.sender,
                block.timestamp,
                choosen
            )
        );

        emit Action(
            msg.sender,
            STAKEHOLDER_ROLE,
            "PROPOSAL VOTE",
            proposal.beneficiary,
            proposal.amount
        );

        return VotedStruct(
            msg.sender,
            block.timestamp,
            choosen
        );
    }

    // Kiem tra dieu kien bo phieu
    function handleVoting(
        ProposalStruct storage proposal
    ) private {
        require(
            !proposal.passed &&
            proposal.duration > block.timestamp,
            "Proposal duration expired"
        );

        uint256[] memory tempVotes =
            stakeholderVotes[msg.sender];

        for (uint256 i = 0; i < tempVotes.length; i++) {
            require(
                proposal.id != tempVotes[i],
                "Double voting not allowed"
            );
        }
    }

    // Thanh toan cho nguoi thu huong
    function payBeneficiary(
        uint256 proposalId
    )
        external
        stakeholderOnly("Unauthorized: Stakeholders only")
        nonReentrant()
        returns (uint256)
    {
        ProposalStruct storage proposal =
            raisedProposals[proposalId];

        require(
            daoBalance >= proposal.amount,
            "Insufficient fund"
        );

        require(!proposal.paid, "Payment sent before");

        require(
            proposal.upvotes > proposal.downvotes,
            "Insufficient votes"
        );

        payTo(proposal.beneficiary, proposal.amount);

        proposal.paid = true;
        proposal.passed = true;
        proposal.executor = msg.sender;

        daoBalance -= proposal.amount;

        emit Action(
            msg.sender,
            STAKEHOLDER_ROLE,
            "PAYMENT TRANSFERED",
            proposal.beneficiary,
            proposal.amount
        );

        return daoBalance;
    }

    // Dong gop ETH vao DAO
    function contribute()
        external
        payable
        returns (uint256)
    {
        require(
            msg.value > 0,
            "Contributing zero is not allowed."
        );

        if (!hasRole(STAKEHOLDER_ROLE, msg.sender)) {
            uint256 totalContribution =
                contributors[msg.sender] + msg.value;

            contributors[msg.sender] += msg.value;

            if (
                totalContribution >=
                MIN_STAKEHOLDER_CONTRIBUTION
            ) {
                stakeholders[msg.sender] =
                    totalContribution;

                _grantRole(
                    STAKEHOLDER_ROLE,
                    msg.sender
                );

                _grantRole(
                    CONTRIBUTOR_ROLE,
                    msg.sender
                );
            } else {
                _grantRole(
                    CONTRIBUTOR_ROLE,
                    msg.sender
                );
            }
        } else {
            contributors[msg.sender] += msg.value;
            stakeholders[msg.sender] += msg.value;
        }

        daoBalance += msg.value;

        emit Action(
            msg.sender,
            STAKEHOLDER_ROLE,
            "CONTRIBUTION RECEIVED",
            address(this),
            msg.value
        );

        return daoBalance;
    }

    // Lay danh sach de xuat
    function getProposals()
        external
        view
        returns (ProposalStruct[] memory props)
    {
        props = new ProposalStruct[](totalProposals);

        for (uint256 i = 0; i < totalProposals; i++) {
            props[i] = raisedProposals[i];
        }
    }

    // Lay thong tin mot de xuat
    function getProposal(
        uint256 proposalId
    )
        external
        view
        returns (ProposalStruct memory)
    {
        return raisedProposals[proposalId];
    }

    // Lay danh sach phieu bau
    function getVotesOf(
        uint256 proposalId
    )
        external
        view
        returns (VotedStruct[] memory)
    {
        return votedOn[proposalId];
    }

    // Lay cac de xuat ma stakeholder da bo phieu
    function getStakeholderVotes()
        external
        view
        stakeholderOnly("Unauthorized: not a stakeholder")
        returns (uint256[] memory)
    {
        return stakeholderVotes[msg.sender];
    }

    // Lay tong tien dong gop cua stakeholder
    function getStakeholderBalance()
        external
        view
        stakeholderOnly("Unauthorized: not a stakeholder")
        returns (uint256)
    {
        return stakeholders[msg.sender];
    }

    // Kiem tra co phai stakeholder khong
    function isStakeholder()
        external
        view
        returns (bool)
    {
        return stakeholders[msg.sender] > 0;
    }

    // Lay tong tien dong gop cua nguoi dung
    function getContributorBalance()
        external
        view
        contributorOnly("Denied: User is not a contributor")
        returns (uint256)
    {
        return contributors[msg.sender];
    }

    // Kiem tra co phai contributor khong
    function isContributor()
        external
        view
        returns (bool)
    {
        return contributors[msg.sender] > 0;
    }

    // Lay tong so ETH hop dong dang giu
    function getBalance()
        external
        view
        returns (uint256)
    {
        return address(this).balance;
    }

    // Chuyen ETH cho nguoi thu huong
    function payTo(
        address to,
        uint256 amount
    )
        internal
        returns (bool)
    {
        (bool success, ) =
            payable(to).call{value: amount}("");

        require(success, "Payment failed");

        return true;
    }
}