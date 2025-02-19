// contrat après ajout de fichier dans ipfs
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract IPFSStorage {
    struct File {
        string cid;
        string name;
    }

    mapping(uint256 => File) public files;
    uint256 public fileCount;

    event FileAdded(uint256 indexed fileId, string cid, string name);

    function addFile(string memory _cid, string memory _name) public {
        files[fileCount] = File(_cid, _name);
        emit FileAdded(fileCount, _cid, _name);
        fileCount += 1;
    }

    function getFile(uint256 _fileId) public view returns (string memory, string memory) {
        File memory file = files[_fileId];
        return (file.cid, file.name);
    }
}
