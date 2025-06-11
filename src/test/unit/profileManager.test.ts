import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ProfileManager, Profile, ProfileItem } from '../../profileManager';

suite('ProfileManager Test Suite', () => {
  let profileManager: ProfileManager;
  let mockContext: any;
  let mockWorkspaceState: any;
  let mockProfiles: Profile[];

  setup(() => {
    mockProfiles = [
      { name: 'Profile1', paths: ['/path1', '/path2'], createdAt: 1600000000000 },
      { name: 'Profile2', paths: ['/path3'], createdAt: 1600000001000 },
    ];

    mockWorkspaceState = {
      get: sinon.stub().returns(mockProfiles),
      update: sinon.stub().resolves(),
    };

    mockContext = {
      workspaceState: mockWorkspaceState,
    };

    profileManager = new ProfileManager(mockContext as vscode.ExtensionContext);
  });

  teardown(() => {
    sinon.restore();
  });

  test('getProfiles should retrieve profiles from workspace state', () => {
    const profiles = profileManager.getProfiles();
    
    assert.strictEqual(profiles.length, 2);
    assert.strictEqual(profiles[0].name, 'Profile1');
    assert.strictEqual(profiles[1].name, 'Profile2');
    
    sinon.assert.calledOnceWithExactly(mockWorkspaceState.get, 'repomix.profiles', []);
  });

  test('saveProfile should create a new profile when it does not exist', () => {
    // Act
    const now = Date.now();
    const clock = sinon.useFakeTimers(now);
    
    try {
      const result = profileManager.saveProfile('Profile3', ['/path4', '/path5']);
      
      // Assert
      assert.strictEqual(result.name, 'Profile3');
      assert.deepStrictEqual(result.paths, ['/path4', '/path5']);
      assert.strictEqual(result.createdAt, now);
      
      sinon.assert.calledWithExactly(
        mockWorkspaceState.update,
        'repomix.profiles',
        [...mockProfiles, result]
      );
    } finally {
      clock.restore();
    }
  });

  test('saveProfile should update an existing profile', () => {
    // Act
    const now = Date.now();
    const clock = sinon.useFakeTimers(now);
    
    try {
      const result = profileManager.saveProfile('Profile1', ['/newpath1', '/newpath2']);
      
      // Assert
      assert.strictEqual(result.name, 'Profile1');
      assert.deepStrictEqual(result.paths, ['/newpath1', '/newpath2']);
      assert.strictEqual(result.createdAt, now);
      
      const updatedProfiles = [
        { name: 'Profile1', paths: ['/newpath1', '/newpath2'], createdAt: now },
        mockProfiles[1]
      ];
      
      sinon.assert.calledWithExactly(
        mockWorkspaceState.update,
        'repomix.profiles',
        updatedProfiles
      );
    } finally {
      clock.restore();
    }
  });

  test('loadProfile should return the requested profile', () => {
    const profile = profileManager.loadProfile('Profile2');
    
    assert.strictEqual(profile?.name, 'Profile2');
    assert.deepStrictEqual(profile?.paths, ['/path3']);
  });

  test('loadProfile should return undefined for non-existent profile', () => {
    const profile = profileManager.loadProfile('NonExistentProfile');
    
    assert.strictEqual(profile, undefined);
  });

  test('deleteProfile should remove the profile and return true if successful', () => {
    const result = profileManager.deleteProfile('Profile1');
    
    assert.strictEqual(result, true);
    
    sinon.assert.calledWithExactly(
      mockWorkspaceState.update,
      'repomix.profiles',
      [mockProfiles[1]]
    );
  });

  test('deleteProfile should return false if profile does not exist', () => {
    const result = profileManager.deleteProfile('NonExistentProfile');
    
    assert.strictEqual(result, false);
    
    sinon.assert.notCalled(mockWorkspaceState.update);
  });

  test('getChildren should return ProfileItems for each profile', () => {
    const children = profileManager.getChildren();
    
    assert.strictEqual(children.length, 2);
    assert.ok(children[0] instanceof ProfileItem);
    assert.ok(children[1] instanceof ProfileItem);
    
    assert.strictEqual(children[0].profile.name, 'Profile1');
    assert.strictEqual(children[1].profile.name, 'Profile2');
  });

  test('getTreeItem should return the provided ProfileItem', () => {
    const profileItem = new ProfileItem(mockProfiles[0]);
    const treeItem = profileManager.getTreeItem(profileItem);
    
    assert.strictEqual(treeItem, profileItem);
  });

  test('ProfileItem should have the correct properties', () => {
    const profileItem = new ProfileItem(mockProfiles[0]);
    
    assert.strictEqual(profileItem.label, 'Profile1');
    assert.strictEqual(profileItem.description, new Date(1600000000000).toLocaleString());
    assert.strictEqual(profileItem.collapsibleState, vscode.TreeItemCollapsibleState.None);
    assert.strictEqual(profileItem.contextValue, 'profile');
    assert.ok(profileItem.iconPath instanceof vscode.ThemeIcon);
  });
});
