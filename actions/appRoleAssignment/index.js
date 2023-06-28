const axios = require('axios');
const core = require('@actions/core');

const SCOPE = 'https://graph.microsoft.com/.default';
const AUTHORITY_HOST_URL = 'https://login.microsoftonline.com';
const GRAPH_ENDPOINT = 'https://graph.microsoft.com/v1.0';

// Read inputs from workflow file
const AZURE_CLIENT_ID = core.getInput('AZURE_CLIENT_ID');
const AZURE_CLIENT_SECRET = core.getInput('AZURE_CLIENT_SECRET');
const AZURE_TENANT_ID = core.getInput('AZURE_TENANT_ID');

const AZURE_APP_NAME = core.getInput('AZURE_APP_NAME');
const AZURE_RESOURCE_TYPE = core.getInput('AZURE_RESOURCE_TYPE');
const AZURE_RESOURCE_NAME = core.getInput('AZURE_RESOURCE_NAME');
var AZURE_ROLE_NAME = core.getInput('AZURE_ROLE_NAME');

// Function to get access token
async function getAccessToken() {

    const data = `grant_type=client_credentials&client_id=${AZURE_CLIENT_ID}&client_secret=${AZURE_CLIENT_SECRET}&scope=${SCOPE}`;
    core.debug(`data: ${data}`);

    const config = {
        headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    return axios.post(`${AUTHORITY_HOST_URL}/${AZURE_TENANT_ID}/oauth2/v2.0/token`, data, config).then((response) => {
        return response.data.access_token;
    }).catch((error) => {
        core.setFailed(error);
    });
};

async function invokeGraphGet(token, url) {

    const config = {
        headers: {
        'Authorization': `Bearer ${token}`
        }
    };

    core.info(`Invoking GET ${url}`);

    return axios.get(url, config).then((response) => {
        return response.data;
    }).catch((error) => {
        core.setFailed(error);
        throw error.response.data.error;
    });

}

async function getApplicationFromName(token, appName) {
    var application = await invokeGraphGet(token, `${GRAPH_ENDPOINT}/servicePrincipals?$filter=displayName eq '${appName}'`)
    return application;
}

async function getUserFromName(token, userName) {
    var user = await invokeGraphGet(token, `${GRAPH_ENDPOINT}/users?$filter=userPrincipalName eq '${userName}'`)
    return user;
}

async function getGroupFromName(token, groupName) {
    var group = await invokeGraphGet(token, `${GRAPH_ENDPOINT}/groups?$filter=displayName eq '${groupName}'`)
    return group;
}

async function assignRole(token, appId, roleId, principalId) {

    const data = `{"principalId": "${principalId}","resourceId": "${appId}","appRoleId": "${roleId}"}`;
    const config = {
        headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
        }
    };

    core.info(`Invoking POST ${GRAPH_ENDPOINT}/servicePrincipals/${appId}/appRoleAssignments`);

    return axios.post(`${GRAPH_ENDPOINT}/servicePrincipals/${appId}/appRoleAssignments`, data, config).then((response) => {
        return response.data;
    }).catch((error) => {
        core.setFailed(error);
        throw error.response.data.error;
    });

}


async function main() {

    core.info(`Assigning role ${AZURE_ROLE_NAME} to ${AZURE_RESOURCE_TYPE} ${AZURE_RESOURCE_NAME} for app ${AZURE_APP_NAME}`)

    var token = await getAccessToken();
    core.debug(`token: ${token}`);

    var app = await getApplicationFromName(token, AZURE_APP_NAME);
    
    if (AZURE_RESOURCE_TYPE == 'Group') {
        var group = await getGroupFromName(token, AZURE_RESOURCE_NAME);
    } else {
        var user = await getUserFromName(token, AZURE_RESOURCE_NAME);
    }

    if (AZURE_ROLE_NAME == null) {
        AZURE_ROLE_NAME = 'User';
    }

    var appId = app.value[0].id;
    var roleId = app.value[0].appRoles.filter(role => role.displayName == AZURE_ROLE_NAME)[0].id;
    var principalId = AZURE_RESOURCE_TYPE == 'Group' ? group.value[0].id : user.value[0].id;

    if (appId == null || roleId == null || principalId == null) {
        core.setFailed('Could not find app, role or principal');
        core.debug(`appId: ${appId}`);
        core.debug(`roleId: ${roleId}`);
        core.debug(`principalId: ${principalId}`);
        return;
    }
    var result = await assignRole(token, appId, roleId, principalId);

    core.info(`Role assigned successfully`)
    core.debug("result: " + JSON.stringify(result));

}

main();